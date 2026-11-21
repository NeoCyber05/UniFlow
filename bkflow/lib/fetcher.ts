export const isUnavailableViewError = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404;
};

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error(`Failed to fetch from ${url}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
};
