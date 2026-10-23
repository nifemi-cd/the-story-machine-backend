export interface PaginationMeta {
  page: number;
  limit: number;
  // across all pages, not just this one
  total: number;
  totalPages: number;
}

// services return this for lists and the response interceptor turns
// items into data and puts meta at the top level
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  success: boolean;
  message: string;
  data: T;
  // only on paginated lists
  meta?: PaginationMeta;
}

export interface FieldError {
  success: boolean;
  // nested fields use dots, like characters.0.name
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  // left out when the error isn't about specific fields
  errors?: FieldError[];
}
