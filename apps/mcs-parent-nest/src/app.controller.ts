import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getHome(): string {
    return "<h1> Welcome to my API! </h1>";
  }
}
