/**
 * FlexLayout ModelFactory.
 *
 * Builds FlexLayout `Model` instances from JSON blobs. Keeps FlexLayout
 * specifics isolated to this file.
 */

import { Model, type IJsonModel } from "flexlayout-react";

export function createModelFromJson(json: unknown): Model {
  return Model.fromJson(json as IJsonModel);
}

export function modelToJson(model: Model): unknown {
  return model.toJson();
}
