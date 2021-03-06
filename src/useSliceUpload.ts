import { ref, toRaw } from 'vue'
import type { Ref } from 'vue'
import { Chunk } from './helpers'
import {
  MergeSliceUploadOptions,
  SliceFileUploadReturn,
  SliceUploadOptions,
  Status,
} from './interface'
import type { Data } from './interface'
import type {
  FileHashToMain,
  FileHashToWorker,
  InternalCustomUploadRequest,
  InternalMergeUploadRequest,
} from './internal-interface'
import {
  Hooks,
  callWithErrorHandling,
  isFunction,
  merge,
  useRequest,
  callWithAsyncErrorHandling,
  concurrentRequest,
  ErrorCode,
  RequestError,
} from './utils'
import FileHashWorker from './worker.js?worker&inline'

// 10M
const DEFAULT_CHUNK_SIZE = 1024 * 1024 * 10

const defaultOptions: MergeSliceUploadOptions<unknown, unknown> = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  concurrentMax: 5,
  concurrentRetryMax: 2,

  name: 'file',
  uploadMethod: 'post',

  mergeName: 'fileHash',
  mergeMethod: 'post',

  withCredentials: false,
}

const Error2StatusMap: Record<ErrorCode, Status> = {
  [ErrorCode.ERR_ABORT]: Status.ABORT,
  [ErrorCode.ERR_BAD_RESPONSE]: Status.ERROR,
  [ErrorCode.ERR_NETWORK]: Status.ERROR,
  [ErrorCode.ERR_TIME_OUT]: Status.TIMEOUT,
}

const createFormData = (name: string, chunk: Chunk, data?: Data) => {
  const fd = new FormData()
  fd.append(name, chunk.blob)
  if (data) {
    Object.keys(data).forEach(key => {
      fd.append(key, data[key] as string | Blob)
    })
  }
  return fd
}

const createMergeParams = (
  fileHash: string,
  name: string,
  data: Data | undefined
) => {
  return { [name]: fileHash, ...data }
}

export const useSliceUpload = <T, R>(
  options: SliceUploadOptions<T, R> = {}
): SliceFileUploadReturn<R> => {
  const {
    chunkSize,
    name,
    mergeName,
    withCredentials,
    concurrentMax,
    concurrentRetryMax,

    uploadAction,
    uploadData,
    uploadHeaders,
    uploadMethod,

    mergeAction,
    mergeData,
    mergeHeaders,
    mergeMethod,

    beforeFileHash,
    successFileHash,
    progressFileHash,
    errorFileHash,

    beforeUploadChunk,
    successUploadChunk,
    errorUploadChunk,
    progressUploadChunk,
    customUploadRequest,

    beforeMergeChunk,
    successMergeChunk,
    errorMergeChunk,
    customMergeRequest,
  } = merge({}, defaultOptions, options) as MergeSliceUploadOptions<T, R>

  const chunks = ref<Chunk[]>([])

  // file hash
  const fileHash = ref<string | undefined>()
  const fileHashLoading = ref<boolean>(false)
  const fileHashProgress = ref<number>(0)
  const fileHashError = ref<unknown>(null)
  const mergeResponse = ref<R>()
  const mergeError = ref<unknown>(null)

  // upload chunk
  const uploading = ref<boolean>(false)

  // merge chunk
  const mergeLoading = ref<boolean>(false)
  let file: File | undefined

  // ?????????????????????
  let aborts: ((() => void) | undefined)[] | undefined
  let aborted = false

  /**
   * ??????????????????
   */
  const createChunks = (file: File, chunkSize: number) => {
    let currentSize = 0
    const chunks: Chunk[] = []
    const total = file.size

    while (currentSize < total) {
      chunks.push(new Chunk(file.slice(currentSize, currentSize + chunkSize)))
      currentSize += chunkSize
    }
    return chunks
  }

  /**
   * ???????????? hash
   */
  const createFileHash = async (file: File, chunks: Chunk[]) => {
    return new Promise<string>((resolve, reject) => {
      fileHashLoading.value = true

      // before filehash hook
      callWithErrorHandling(
        beforeFileHash,
        Hooks.BEFORE_FILE_HASH,
        file,
        chunks
      )

      const worker = new FileHashWorker()
      worker.addEventListener('message', e => {
        const { fileHash, progress, index, done } = e.data as FileHashToMain

        fileHashProgress.value = progress

        // change filehash hook
        callWithErrorHandling(progressFileHash, Hooks.CHANGE_FILE_HASH, {
          file,
          progress,
          index,
          chunks,
        })

        if (done) {
          fileHashLoading.value = false
          callWithErrorHandling(successFileHash, Hooks.SUCCESS_FILE_HASH, {
            fileHash: fileHash!,
            file,
            chunks,
          })
          return resolve(fileHash!)
        }
      })

      worker.addEventListener('messageerror', error => {
        fileHashLoading.value = false
        fileHashError.value = error
        // TODO:
        callWithErrorHandling(errorFileHash, Hooks.ERROR_FILE_HASH, {
          file,
          chunks,
          error,
        })
        reject()
      })

      const data: FileHashToWorker = { chunks: toRaw(chunks) }
      worker.postMessage(data)
    })
  }

  /**
   * ???????????????????????????
   */
  const createUploadChunkTask = async (
    file: File,
    fileHash: string,
    index: number,
    chunk: Chunk
  ) => {
    const method = uploadMethod
    const url = isFunction(uploadAction)
      ? await callWithAsyncErrorHandling(uploadAction, Hooks.UPLOAD_ACTION, {
          file,
          fileHash,
          chunk,
          index,
        })
      : uploadAction

    const data = isFunction(uploadData)
      ? await callWithAsyncErrorHandling(uploadData, Hooks.UPLOAD_DATA, {
          file,
          fileHash,
          chunk,
          index,
        })
      : createFormData(name, chunk, uploadData as Data)

    return new Promise<T>((_resolve, _reject) => {
      const resolve = (response: T) => {
        _resolve(response)
      }

      const reject = (error: any) => {
        _reject(error)
      }

      const onBefore = () => {
        callWithErrorHandling(beforeUploadChunk, Hooks.BEFORE_UPLOAD_CHUNK, {
          file,
          fileHash,
          index,
          chunk,
        })

        chunk.setUploading()
      }

      const onSuccess = (response: T) => {
        chunk.setSuccess(response)
        callWithErrorHandling(successUploadChunk, Hooks.SUCCESS_UPLOAD_CHUNK, {
          file,
          fileHash,
          index,
          chunk,
          response,
        })

        resolve(response)
      }

      const onError = (error: RequestError) => {
        chunk.setError(
          Error2StatusMap[error.code] || Status.ERROR,
          error.response
        )
        callWithErrorHandling(errorUploadChunk, Hooks.ERROR_UPLOAD_CHUNK, {
          file,
          fileHash,
          index,
          chunk,
          error,
        })

        reject(error)
      }

      const onProgress = (loaded: number, total: number) => {
        chunk.progress = (loaded / total) * 100
        callWithErrorHandling(
          progressUploadChunk,
          Hooks.PROGRESS_UPLOAD_CHUNK,
          {
            file,
            fileHash,
            index,
            chunk,
            loaded,
            total,
          }
        )
      }

      const onAbort = (abort: () => void) => {
        if (aborts) {
          aborts[index] = abort
        }
      }

      const params: InternalCustomUploadRequest<T> = {
        url,
        data,
        file,
        fileHash,
        chunk,
        index,
        headers: uploadHeaders,
        method,
        onSuccess,
        onError,
        onProgress,
        onBefore,
        onAbort,
      }

      if (isFunction(customUploadRequest)) {
        return _createCustomUploadChunkTask(params)
      }

      if (!url) {
        throw new Error('missing upload url')
      }

      _createDefaultUploadChunkTask(params)
    })
  }

  /**
   * ??????????????????????????? - ?????????
   */
  const _createCustomUploadChunkTask = (
    params: InternalCustomUploadRequest<T>
  ) => {
    params.onBefore()

    callWithAsyncErrorHandling(
      customUploadRequest!,
      Hooks.CUSTOM_UPLOAD_CHUNK,
      params
    )
  }

  /**
   * ??????????????????????????? - ??????
   */
  const _createDefaultUploadChunkTask = async (
    params: InternalCustomUploadRequest<T>
  ) => {
    const {
      url,
      data,
      headers,
      method,
      onBefore,
      onError,
      onProgress,
      onSuccess,
      onAbort,
    } = params
    onBefore()

    try {
      const { abort, execute } = useRequest<T>({
        immediate: false,
        url: url!,
        data,
        method,
        withCredentials,
        headers,
        responseType: 'json',
        onUploadProgress(loaded, total) {
          onProgress(loaded, total)
        },
      })

      onAbort(abort)

      const response = await execute()

      onSuccess(response)

      return response
    } catch (error: any) {
      onError(error)

      // ??????
      throw error
    }
  }

  /**
   * ????????????
   */
  const startUpload = async (file: File, fileHash: string, chunks: Chunk[]) => {
    aborted = false
    aborts = []
    // ??????????????????????????????????????????
    const tasks: (() => Promise<unknown>)[] = []
    chunks.forEach((chunk, index) => {
      if (chunk.isUnUpload()) {
        tasks.push(() => createUploadChunkTask(file, fileHash, index, chunk))
      }
    })

    // ????????????????????????????????????
    await concurrentRequest(tasks, {
      max: concurrentMax,
      retryCount: concurrentRetryMax,
      // TODO: ????????????????????????
      beforeRequest: () => !aborted,
    })
  }

  /**
   * ????????????
   */
  const mergeChunks = async (file: File, fileHash: string) => {
    const method = mergeMethod
    const url = isFunction(mergeAction)
      ? await callWithAsyncErrorHandling(mergeAction, Hooks.MERGE_ACTION, {
          file,
          fileHash,
        })
      : mergeAction

    const data = isFunction(mergeData)
      ? await callWithAsyncErrorHandling(mergeData, Hooks.MERGE_DATA, {
          file,
          fileHash,
        })
      : createMergeParams(fileHash, mergeName, mergeData)

    return new Promise<R>((_resovle, _reject) => {
      const resolve = (response: R) => {
        _resovle(response)
      }

      const reject = (error: any) => {
        _reject(error)
      }

      const onBefore = () => {
        mergeLoading.value = true
        callWithErrorHandling(beforeMergeChunk, Hooks.BEFORE_MERGE_CHUNK, {
          file,
          fileHash,
        })
      }

      const onSuccess = (response: R) => {
        mergeResponse.value = response
        mergeLoading.value = false
        callWithErrorHandling(successMergeChunk, Hooks.SUCCESS_MERGE_CHUNK, {
          file,
          fileHash,
          response,
        })

        resolve(response)
      }

      const onError = (error: unknown) => {
        mergeError.value = error
        mergeLoading.value = false
        callWithErrorHandling(errorMergeChunk, Hooks.ERROR_MERGE_CHUNK, {
          file,
          fileHash,
          error,
        })

        reject(error)
      }

      const params: InternalMergeUploadRequest<R> = {
        url,
        method,
        headers: mergeHeaders,
        file,
        fileHash,
        data,
        onSuccess,
        onError,
        onBefore,
      }

      if (isFunction(customMergeRequest)) {
        return _mergeChunksCustom(params)
      }

      if (!url) {
        return reject(new Error('missing merge url'))
      }

      _mergeChunksDefault(params)
    })
  }

  /**
   * ???????????? - ?????????
   */
  const _mergeChunksCustom = (params: InternalMergeUploadRequest<R>) => {
    params.onBefore()

    callWithAsyncErrorHandling(
      customMergeRequest!,
      Hooks.CUSTOM_UPLOAD_CHUNK,
      params
    )
  }

  /**
   * ???????????? - ??????
   */
  const _mergeChunksDefault = async (params: InternalMergeUploadRequest<R>) => {
    const { url, method, data, onBefore, onError, onSuccess } = params
    try {
      onBefore()

      const { execute } = useRequest<R>({
        immediate: false,
        url: url!,
        method,
        data,
        withCredentials,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...mergeHeaders,
        },
      })
      const response = await execute()

      onSuccess(response)

      return response
    } catch (error) {
      onError(error)
    }
  }

  /**
   * ????????????
   */
  const start = async (uploadFile: File) => {
    file = uploadFile
    toggleUpload(async () => {
      chunks.value = createChunks(uploadFile, chunkSize)
      fileHash.value = await createFileHash(uploadFile, chunks.value)
      await uploadAndMerge(uploadFile, fileHash.value, chunks)
    })
  }

  /**
   * ????????????
   */
  const cancelUpload = () => {
    if (aborts) {
      aborted = true
      aborts!.forEach(cancel => {
        if (cancel) {
          cancel()
        }
      })

      aborts = undefined
    }
  }

  /**
   * ????????????
   */
  const resumeUpload = async () => {
    const isUnUpload = chunks.value!.find(chunk => chunk.isUnUpload())
    if (file && isUnUpload) {
      toggleUpload(async () => {
        await uploadAndMerge(file!, fileHash.value!, chunks!)
      })
    }
  }

  /**
   * ?????? uploading ??????
   */
  const toggleUpload = async (fn: (...args: unknown[]) => void) => {
    uploading.value = true
    await fn()
    uploading.value = false
  }

  /**
   * ?????????????????????
   */
  const uploadAndMerge = async (
    uploadFile: File,
    fileHash: string,
    chunks: Ref<Chunk[]>
  ) => {
    await startUpload(uploadFile, fileHash, chunks.value)
    await mergeChunks(uploadFile, fileHash)
  }

  return {
    uploading,
    chunks,
    fileHash,
    fileHashLoading,
    fileHashProgress,
    fileHashError,
    mergeLoading,
    mergeResponse,
    mergeError,
    start,
    cancel: cancelUpload,
    resume: resumeUpload,
  }
}
