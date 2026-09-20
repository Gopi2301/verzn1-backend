import { Module } from "@nestjs/common";
import { CoachingController } from "./coaching.controller.js";
import { CoachingService } from "./coaching.service.js";

@Module({
    imports: [],
    controllers: [CoachingController],
    providers: [CoachingService],
    exports: [CoachingService],
})
export class CoachingModule { }
