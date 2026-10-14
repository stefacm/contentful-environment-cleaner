const contentful = require('contentful-management');

function createContentfulGateway({ managementToken }) {
  const config = {
    accessToken: managementToken,
    throttle: 'auto',
  };

  // El cliente legacy expone los métodos de ciclo de vida de las entidades.
  const legacyClient = contentful.createClient(config, { type: 'legacy' });
  const client = contentful.createClient(config);

  return {
    async isEnvironmentAlias(spaceId, environmentId) {
      const aliases = await client.environmentAlias.getMany({ spaceId });
      return aliases.items.find(({ sys }) => sys.id === environmentId);
    },

    async getEnvironment(spaceId, environmentId) {
      const space = await legacyClient.getSpace(spaceId);
      return space.getEnvironment(environmentId);
    },

    async collectIds(fetchPage) {
      const ids = [];
      let skip = 0;
      const limit = 100;

      while (true) {
        const response = await fetchPage({ skip, limit });
        ids.push(...response.items.map((item) => item.sys.id));
        skip += response.items.length;

        if (response.items.length === 0 || skip >= response.total) {
          return ids;
        }
      }
    },

    async listIds(environment, type) {
      const fetchers = {
        Entry: (query) => environment.getEntries(query),
        Asset: (query) => environment.getAssets(query),
        ContentType: (query) => environment.getContentTypes(query),
      };

      return this.collectIds(fetchers[type]);
    },

    async delete(environment, type, id) {
      const getters = {
        Entry: () => environment.getEntry(id),
        Asset: () => environment.getAsset(id),
        ContentType: () => environment.getContentType(id),
      };

      let entity = await getters[type]();

      if (entity.isArchived?.()) {
        entity = await entity.unarchive();
      }

      if (entity.isPublished()) {
        entity = await entity.unpublish();
      }

      await entity.delete();
    },
  };
}

module.exports = { createContentfulGateway };
