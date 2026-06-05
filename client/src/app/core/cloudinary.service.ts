import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly baseUrl = `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}`;
  private readonly uploadPreset = environment.cloudinary.uploadPreset;

  /** Uploads an audio file (MP3). Cloudinary requires resource_type=video for audio. */
  async uploadAudio(blob: Blob, filename: string): Promise<CloudinaryUploadResult> {
    if (environment.mock) return this.mockUpload(blob);
    return this.upload(blob, filename, 'video');
  }

  /** Uploads a cover image. */
  async uploadImage(file: File): Promise<CloudinaryUploadResult> {
    if (environment.mock) return this.mockUpload(file);
    return this.upload(file, file.name, 'image');
  }

  /** Userless mode: don't hit Cloudinary, just serve the blob via an object URL. */
  private mockUpload(data: Blob): CloudinaryUploadResult {
    const url = URL.createObjectURL(data);
    return { publicId: `mock-${Math.random().toString(36).slice(2)}`, url, secureUrl: url };
  }

  /** Deletes a resource from Cloudinary.
   *  NOTE: deletion from the client requires a signed request or an Admin API call.
   *  With an unsigned preset this is a no-op — deletion is handled server-side or
   *  via the Cloudinary dashboard. Replace with a server-side call if needed. */
  async delete(_publicId: string, _resourceType: 'video' | 'image'): Promise<void> {
    // Unsigned delete is not supported; skip silently.
    // To enable, call your own backend which uses the Cloudinary Admin SDK.
  }

  private async upload(
    data: Blob | File,
    filename: string,
    resourceType: 'video' | 'image',
  ): Promise<CloudinaryUploadResult> {
    const form = new FormData();
    form.append('file', data, filename);
    form.append('upload_preset', this.uploadPreset);

    const res = await fetch(`${this.baseUrl}/${resourceType}/upload`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err['error']?.['message'] ?? `Cloudinary upload failed (${res.status})`);
    }

    const json = await res.json();
    return {
      publicId: json['public_id'],
      url: json['url'],
      secureUrl: json['secure_url'],
    };
  }
}
