export async function execute() {
  throw Object.assign(new Error('Los nodos de aprobación aún no están soportados'), { retryable: false });
}
