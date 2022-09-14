import Plugin from '@hilla/generator-typescript-core/Plugin.js';
import { isEnumSchema, resolveReference } from '@hilla/generator-typescript-core/Schema.js';
import type SharedStorage from '@hilla/generator-typescript-core/SharedStorage';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import type { SourceFile } from 'typescript';
import { Context, EntityModelProcessor } from './EntityModelProcessor.js';

export enum ModelPluginSourceType {
  Model = 'model',
}

export default class ModelPlugin extends Plugin {
  public static readonly MODEL_PLUGIN_FILE_TAGS = 'MODEL_PLUGIN_FILE_TAGS';
  public declare ['constructor']: typeof ModelPlugin;
  readonly #tags = new WeakMap<SourceFile, ModelPluginSourceType>();

  public override get path(): string {
    return import.meta.url;
  }

  public override async execute(storage: SharedStorage): Promise<void> {
    const files = this.#processEntities(storage.api.components?.schemas);
    files.forEach((file) => this.#tags.set(file, ModelPluginSourceType.Model));
    storage.sources.push(...files);
    storage.pluginStorage.set(this.constructor.MODEL_PLUGIN_FILE_TAGS, this.#tags);
  }

  #processEntities(schemas: ReadonlyDeep<OpenAPIV3.ComponentsObject>['schemas'] | undefined): readonly SourceFile[] {
    this.logger.debug('Processing entities');

    if (!schemas) {
      return [];
    }

    const ctx: Context = {
      isReferenceToEnum(schema) {
        const resolved = resolveReference(schemas, schema);
        return !!resolved && isEnumSchema(resolved);
      },
      owner: this,
    };

    return schemas
      ? Object.entries(schemas)
          .filter(([, component]) => !isEnumSchema(component))
          .map(([name, component]) => new EntityModelProcessor(name, component, ctx).process())
      : [];
  }
}
