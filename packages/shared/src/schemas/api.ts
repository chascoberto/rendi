/** Forma de todas las respuestas de error de la API. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    issues?: { path: string; message: string }[]
  }
}
