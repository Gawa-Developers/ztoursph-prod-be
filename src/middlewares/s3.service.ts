import { Injectable } from '@nestjs/common';
import { S3Service } from 'src/third-party/aws-sdk/s3.object';

@Injectable()
export class S3BucketService {
  constructor(private readonly s3Service: S3Service) {}
  private BUCKET_NAME = process.env.AWS_S3_BUCKET;

  async getImage(Key) {
    const image = await this.s3Service.getFileURI(Key, this.BUCKET_NAME);
    return image;
  }

  async getPDF(Key) {
    return this.getImage(Key);
  }

  async getPdfBuffer(Key) {
    const buffer = await this.s3Service.getObjectBuffer(Key, this.BUCKET_NAME);
    return buffer;
  }
}
