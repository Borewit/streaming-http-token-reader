import * as initDebug from 'debug';
import * as _fetch from 'node-fetch';
import { IContentRangeType, IHeadRequestInfo, IRangeRequestResponse, IRangeRequestClient, parseContentRange } from '@tokenizer/range'; // Add 'fetch' API for node.js

const debug = initDebug('streaming-http-token-reader:http-client');

/**
 * Configuration options for the HTTP client.
 */
export type HttpClientConfig = {
  resolveUrl?: boolean
};

const DEFAULT_CONFIG = {
  resolveUrl: false
};

/**
 * Simple HTTP-client, which both works in node.js and browser
 */
export class HttpClient implements IRangeRequestClient {

  private static getContentLength(headers: _fetch.Headers): number {
    const contentLength = headers.get('Content-Length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  }

  private static parseContentRange(headers: _fetch.Headers): IContentRangeType {
    const contentRange = headers.get('Content-Range');
    return parseContentRange(contentRange);
  }

  private static makeResponse(resp): IRangeRequestResponse {
    const contentRange = HttpClient.parseContentRange(resp.headers);
    return {
      url: resp.url,
      size: contentRange ? contentRange.instanceLength : HttpClient.getContentLength(resp.headers),
      mimeType: resp.headers.get('Content-Type'),
      contentRange,
      arrayBuffer: () => resp.arrayBuffer()
    };
  }

  public resolvedUrl: string;
  private config: HttpClientConfig;

  constructor(private url: string, config?: HttpClientConfig) {
    this.config = DEFAULT_CONFIG;
    Object.assign(this.config, config);
  }

  public async getHeadInfo(): Promise<IHeadRequestInfo> {
    const response = await _fetch(this.url, {method: 'HEAD'});
    if (this.config.resolveUrl) this.resolvedUrl = response.url;
    return HttpClient.makeResponse(response);
  }

  public async getResponse(method: string, range?: [number, number]): Promise<IRangeRequestResponse> {
    if (range) {
      debug(`_getResponse ${method} ${range[0]}..${range[1]}`);
    } else {
      debug(`_getResponse ${method} (range not provided)`);
    }

    const headers = new _fetch.Headers();
    headers.set('Range', 'bytes=' + range[0] + '-' + range[1]);

    const response = await _fetch(this.resolvedUrl || this.url, {method, headers});
    if (response.ok) {
      if (this.config.resolveUrl) this.resolvedUrl = response.url;
      return HttpClient.makeResponse(response);
    } else {
      throw new Error(`Unexpected HTTP response status=${response.status}`);
    }
  }

}
