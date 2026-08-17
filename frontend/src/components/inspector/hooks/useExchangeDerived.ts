import { useMemo } from 'react';
import { HttpRequest } from '../../../types';
import {
  formatContent,
  getBodyString,
  parseQueryParams,
  parseRequestCookies,
  parseResponseCookies,
  generateCurl,
} from '../../../lib/httpFormat';

export function useExchangeDerived(req: HttpRequest) {
  const resp = req.response;
  const reqHeaders = req.headers || {};
  const respHeaders = resp?.headers || {};
  const reqBodyRaw = getBodyString(req);
  const respBodyRaw = getBodyString(resp);

  const reqFormatted = useMemo(
    () => formatContent(reqBodyRaw, reqHeaders['Content-Type']?.[0] || reqHeaders['content-type']?.[0]),
    [reqBodyRaw, reqHeaders]
  );
  const respFormatted = useMemo(
    () => formatContent(respBodyRaw, resp?.contentType),
    [respBodyRaw, resp?.contentType]
  );

  const queryParams = useMemo(() => parseQueryParams(req.url || ''), [req.url]);
  const requestCookies = useMemo(() => parseRequestCookies(reqHeaders), [reqHeaders]);
  const responseCookies = useMemo(() => parseResponseCookies(respHeaders), [respHeaders]);
  const curl = useMemo(() => generateCurl(req), [req]);

  const isImageResponse = Boolean(String(resp?.contentType || '').toLowerCase().includes('image/'));

  return {
    resp,
    reqHeaders,
    respHeaders,
    reqBodyRaw,
    respBodyRaw,
    reqFormatted,
    respFormatted,
    queryParams,
    requestCookies,
    responseCookies,
    curl,
    isImageResponse,
  };
}
