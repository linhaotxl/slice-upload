import { Ref } from 'vue'
import { Chunk } from './helpers'
import { RequestError } from './utils'

export type Data = Record<string, unknown>

/**
 * hooks
 */

/**
 * before hash hook
 */
export type BeforeFileHash = (file: File, chunks: Chunk[]) => void

/**
 * change hash hook
 */
export type ProcessFileHash = (params: {
  file: File
  progress: number
  index: number
  chunks: Chunk[]
}) => void

/**
 * success hash hook
 */
export type SuccessFileHash = (params: {
  fileHash: string
  file: File
  chunks: Chunk[]
}) => void

/**
 * error hash hook
 */
export type ErrorFileHash = (params: {
  error: unknown
  file: File
  chunks: Chunk[]
}) => void

/**
 * before upload chunk hook
 */
export type BeforeUploadChunk = (params: {
  file: File
  fileHash: string
  index: number
  chunk: Chunk
}) => void

/**
 * success upload chunk hook
 */
export type SuccessUploadChunk = <T = any>(params: {
  file: File
  fileHash: string
  index: number
  chunk: Chunk
  response: T
}) => void

/**
 * error upload chunk hook
 */
export type ErrorUploadChunk = (params: {
  file: File
  fileHash: string
  index: number
  chunk: Chunk
  error: unknown
}) => void

/**
 * progress upload chunk hook
 */
export type ProgressUploadChunk = (params: {
  file: File
  fileHash: string
  chunk: Chunk
  index: number
  loaded: number
  total: number
}) => void

/**
 * custom upload request
 */
export interface CustomUploadRequestOptions<T = unknown> {
  url: string | undefined
  data: Data | FormData
  headers: Data | undefined
  method: string
  file: File
  fileHash: string
  chunk: Chunk
  index: number
  onSuccess: (response: T) => void
  onError: (error: RequestError) => void
  onProgress: (loaded: number, total: number) => void
  onAbort: (abort: () => void) => void
}
export type CustomUploadRequest<T = unknown> = (
  options: CustomUploadRequestOptions<T>
) => void

/**
 * before merge chunk hook
 */
export type BeforeMergeChunk = (params: {
  file: File
  fileHash: string
}) => void

/**
 * success merge chunk hook
 */
export type SuccessMergeChunk = <T = any>(params: {
  file: File
  fileHash: string
  response: T
}) => void

/**
 * error merge chunk hook
 */
export type ErrorMergeChunk = <T = any>(params: {
  file: File
  fileHash: string
  error: T
}) => void

/**
 * custom upload request
 */
export interface CustomMergeRequestOptions<R = unknown> {
  url: string | undefined
  data: Data
  headers: Data | undefined
  method: string
  file: File
  fileHash: string
  onSuccess: (response: R) => void
  onError: (error: any) => void
}
export type CustomMergeRequest<R = unknown> = (
  params: CustomMergeRequestOptions<R>
) => void

// upload
export type UploadAction =
  | string
  | ((params: {
      file: File
      chunk: Chunk
      index: number
      fileHash: string
    }) => string | Promise<string>)

export type UploadData =
  | Data
  | FormData
  | ((params: {
      file: File
      chunk: Chunk
      index: number
      fileHash: string
    }) => Data | FormData | Promise<Data | FormData>)

// merge
export type MergeAction =
  | string
  | ((params: { file: File; fileHash: string }) => string | Promise<string>)

export type MergeData =
  | Data
  | ((params: { file: File; fileHash: string }) => Data | Promise<Data>)

export enum Status {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
  UPLOADING = 'uploading',
  ABORT = 'abort',
  TIMEOUT = 'timeout',
}

/**
 * Return
 */
export interface SliceFileUploadReturn<R> {
  /**
   * 是否正在上传，包括：计算 hash、上传切片、合并切片
   */
  uploading: Ref<boolean>

  /**
   * 切片列表
   */
  chunks: Ref<Chunk[]>

  /**
   * 文件 hash
   */
  fileHash: Ref<string | undefined>

  /**
   * 是否正在计算文件 hash
   */
  fileHashLoading: Ref<boolean>

  /**
   * 计算文件 hash 的进度
   */
  fileHashProgress: Ref<number>

  /**
   * 计算文件 hash 错误信息
   */
  fileHashError: Ref<unknown>

  /**
   * 是否正在合并切片
   */
  mergeLoading: Ref<boolean>

  /**
   * 合并切片的响应数据
   */
  mergeResponse: Ref<R | undefined>

  /**
   * 合并切片的错误信息
   */
  mergeError: Ref<unknown>

  /**
   * 开始上传
   * @param {File} uploadFile 上传原始文件
   */
  start: (uploadFile: File) => Promise<void>

  /**
   * 取消上传
   */
  cancel: () => void

  /**
   * 恢复上传
   */
  resume: () => Promise<void>
}

export interface SliceUploadOptions<T, R> {
  /**
   * 切片大小
   * @default 1024 * 1014 * 10
   */
  chunkSize?: number

  /**
   * 并发请求数量
   * @default 5
   */
  concurrentMax?: number

  /**
   * 失败后尝试重试的次数
   * @default 2
   */
  concurrentRetryMax?: number

  /**
   * 开始计算文件 hash
   */
  beforeFileHash?: BeforeFileHash

  /**
   * 计算文件 hash 的进度
   */
  progressFileHash?: ProcessFileHash

  /**
   * 计算文件 hash 成功
   */
  successFileHash?: SuccessFileHash

  /**
   * 计算文件 hash 失败
   */
  errorFileHash?: ErrorFileHash

  /**
   * 开始上传切片
   */
  beforeUploadChunk?: BeforeUploadChunk

  /**
   * 上传切片成功
   */
  successUploadChunk?: SuccessUploadChunk

  /**
   * 上传切片失败
   */
  errorUploadChunk?: ErrorUploadChunk

  /**
   * 上传切片进度
   */
  progressUploadChunk?: ProgressUploadChunk

  /**
   * 开始合并切片
   */
  beforeMergeChunk?: BeforeMergeChunk

  /**
   * 合并切片成功
   */
  successMergeChunk?: SuccessMergeChunk

  /**
   * 合并切片失败
   */
  errorMergeChunk?: ErrorMergeChunk

  /**
   * 切片在提交表单中的字段名
   * @default 'file'
   */
  name?: string

  /**
   * fileHash 在合并中的字段名
   * @default 'fileHash'
   */
  mergeName?: string

  /**
   * 是否允许携带 cookie
   * @default false
   */
  withCredentials?: boolean

  /**
   * 上传切片的请求地址
   */
  uploadAction?: UploadAction

  /**
   * 上传切片的请求数据
   */
  uploadData?: UploadData

  /**
   * 上传切片的请求头
   */
  uploadHeaders?: Data

  /**
   * 上传切片的请求方法
   * @default 'post'
   */
  uploadMethod?: string

  /**
   * 自定义上传请求
   */
  customUploadRequest?: CustomUploadRequest<T>

  /**
   * 合并切片的请求地址
   */
  mergeAction?: MergeAction

  /**
   * 合并切片的请求数据
   */
  mergeData?: MergeData

  /**
   * 合并切片的请求头
   */
  mergeHeaders?: Data

  /**
   * 合并切片的请求方法
   * @default 'post'
   */
  mergeMethod?: string

  /**
   * 自定义合并请求
   */
  customMergeRequest?: CustomMergeRequest<R>
}

export type MergeSliceUploadOptions<T, R> = Required<
  Pick<
    SliceUploadOptions<T, R>,
    | 'chunkSize'
    | 'concurrentMax'
    | 'concurrentRetryMax'
    | 'name'
    | 'mergeName'
    | 'withCredentials'
    | 'uploadMethod'
    | 'mergeMethod'
  >
> &
  SliceUploadOptions<T, R>
