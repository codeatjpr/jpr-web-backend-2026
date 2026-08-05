import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

type Schemas = {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body)
      if (schemas.query) {
        // Express 5: req.query is read-only — validate without reassignment
        schemas.query.parse(req.query)
      }
      if (schemas.params) {
        schemas.params.parse(req.params)
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
