import { Injectable, HttpService } from '@nestjs/common';

@Injectable()
export class MixerService {
  constructor(private readonly httpService: HttpService) {}

  async searchUser(query: string) {
    return this.httpService
      .request({
        method: 'get',
        url: 'https://mixer.com/api/v1/users/search',
        params: {
          query,
        },
      })
      .toPromise();
  }

  async getChannelRecordings(channelId: number) {
    return this.httpService
      .request({
        method: 'get',
        url: `https://mixer.com/api/v1/channels/${channelId}/recordings`,
        params: {
          limit: 100,
        },
      })
      .toPromise();
  }
}
