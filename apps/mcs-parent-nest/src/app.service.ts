import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getFormattedDateTime(): string {
    const now = new Date();

    const options: Intl.DateTimeFormatOptions = {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };

    const formattedDateTime = now.toLocaleString("es-CO", options);

    const [date, time] = formattedDateTime.split(", ");

    return `${date} : ${time}`;
  }
}
