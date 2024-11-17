import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getFormattedDateTime(): string {
    const now = new Date();

    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12; // Convertir a formato de 12 horas

    const date = `${day}/${month}/${year}`;
    const time = `${hours}:${minutes} ${ampm}`;

    return `${date} : ${time}`;
  }
}
