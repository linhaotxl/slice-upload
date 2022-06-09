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
export type ErrorUploadChunk = <T = unknown>(params: {
  file: File
  fileHash: string
  index: number
  chunk: Chunk
  error: T
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
) => Promise<T>

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
) => Promise<R>

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
  | ((params: {
      file: File
      chunk: Chunk
      index: number
      fileHash: string
    }) => Data | Promise<Data>)

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