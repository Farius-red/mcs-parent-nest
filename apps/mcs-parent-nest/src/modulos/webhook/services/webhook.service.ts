import { Injectable } from '@nestjs/common';

import axios from 'axios';

@Injectable()
export class WebhookService {
  async sendTaskGit(payload: any) {
    if (payload.action === 'create' && payload.type === 'task') {
      const title = payload.data.subject;
      const description = payload.data.description;

      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const repoUrl = description.match(urlRegex)?.[0];

      if (repoUrl) {
        await this.createGithubIssue(title, description, repoUrl);
      } else {
        console.log('No se encontró una URL de repositorio en la descripción.');
      }
    }
  }

  async createGithubIssue(title: string, body: string, repoUrl: string) {
    const url = `${repoUrl}/issues`;
    const headers = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    };
    const data = {
      title,
      body,
    };

    await axios.post(url, data, { headers });
  }
}
