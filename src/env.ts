// Get environment variables safely
const { VITE_APP_API_URL } = import.meta.env;

export const APP_API_URL = VITE_APP_API_URL;