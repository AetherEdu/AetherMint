import Joi from 'joi';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ValidationError } from '../utils/errors';

type ValidationSource = 'body' | 'query' | 'params';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export function validate(schema: Joi.Schema, source: ValidationSource): RequestHandler;
export function validate(schema: ValidationSchema): RequestHandler;
export function validate(
  schema: ValidationSchema | Joi.Schema,
  source?: ValidationSource
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    if (source) {
      const schemaForSource = Joi.isSchema(schema)
        ? schema
        : (schema as ValidationSchema)[source];

      if (!schemaForSource) {
        return next();
      }

      const { error, value } = schemaForSource.validate(req[source], {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const details = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
        return next(new ValidationError('Validation failed', details));
      }

      req[source] = value;
      return next();
    }

    const validationSchema = schema as ValidationSchema;

    for (const src of ['body', 'query', 'params'] as const) {
      if (validationSchema[src]) {
        const { error, value } = validationSchema[src]!.validate(req[src], {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true,
          ...(src === 'query' && { convert: true }),
        });
        if (error) {
          error.details.forEach(d =>
            errors.push({ field: d.path.join('.'), message: d.message })
          );
        } else {
          req[src] = value;
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
}
