
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

export function apiFetch(endpoint, options = {}) {
  const path = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  return fetch(`${API_BASE_URL}${path}`, options);
}
