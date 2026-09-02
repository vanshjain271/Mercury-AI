import { Module } from "@medusajs/framework/utils"
import MercuryModuleService from "./service"

export const MERCURY_MODULE = "mercury"

export default Module(MERCURY_MODULE, {
  service: MercuryModuleService,
})
