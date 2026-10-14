/*
  Como ejecutar:

  1. Instala las dependencias desde esta carpeta:
     npm install

  2. Crea un archivo .env con:
     CONTENTFUL_MANAGEMENT_TOKEN=...
     CONTENTFUL_SPACE_ID=...
     CONTENTFUL_ENVIRONMENT_ID=...

  3. Ejecuta primero una simulacion (no elimina nada):
     node clean-contentful-environment.cjs

  4. Si el resultado es correcto, ejecuta el borrado real con la
     confirmacion explicita del mismo environment:
     DRY_RUN=false CONFIRM_ENVIRONMENT_ID=mi-environment \
       node clean-contentful-environment.cjs

  Sustituye "mi-environment" por el valor exacto de
  CONTENTFUL_ENVIRONMENT_ID. El script no permite limpiar un alias.
*/

require('dotenv').config();

const contentful = require('contentful-management');

const {
  CONTENTFUL_MANAGEMENT_TOKEN,
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_ENVIRONMENT_ID,
  DRY_RUN = 'false',
  CONFIRM_ENVIRONMENT_ID,
} = process.env;

const isDryRun = DRY_RUN.toLowerCase() !== 'false';

if (!CONTENTFUL_MANAGEMENT_TOKEN) {
  throw new Error('Falta CONTENTFUL_MANAGEMENT_TOKEN');
}

if (!CONTENTFUL_SPACE_ID) {
  throw new Error('Falta CONTENTFUL_SPACE_ID');
}

if (!CONTENTFUL_ENVIRONMENT_ID) {
  throw new Error('Falta CONTENTFUL_ENVIRONMENT_ID');
}

const config = {
  accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
  throttle: 'auto',
};

// Cliente actual: lo usamos para validar aliases.
const client = contentful.createClient(config);

// Cliente legacy: útil aquí porque las entidades traen métodos
// isPublished(), isArchived(), unpublish(), unarchive(), delete().
const legacyClient = contentful.createClient(config, {
  type: 'legacy',
});

const errors = [];

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    JSON.stringify(error)
  );
}

async function validateEnvironmentIsNotAlias() {
  const aliases = await client.environmentAlias.getMany({
    spaceId: CONTENTFUL_SPACE_ID,
  });

  const alias = aliases.items.find(
    ({ sys }) => sys.id === CONTENTFUL_ENVIRONMENT_ID
  );

  if (alias) {
    const target =
      alias.environment?.sys?.id ||
      alias.sys?.environment?.sys?.id ||
      'desconocido';

    throw new Error(
      [
        `El ID "${CONTENTFUL_ENVIRONMENT_ID}" corresponde a un ENVIRONMENT ALIAS.`,
        `Actualmente apunta a: "${target}".`,
        '',
        'Por seguridad el script no permite limpiar usando un alias.',
        'Usa directamente el ID real del environment.',
      ].join('\n')
    );
  }
}

async function collectIds(fetchPage) {
  const ids = [];

  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await fetchPage({
      skip,
      limit,
    });

    ids.push(...response.items.map((item) => item.sys.id));

    skip += response.items.length;

    if (
      response.items.length === 0 ||
      skip >= response.total
    ) {
      break;
    }
  }

  return ids;
}

async function deleteEntry(environment, id) {
  try {
    let entry = await environment.getEntry(id);

    console.log(`  Entry: ${id}`);

    if (entry.isArchived()) {
      console.log('    ↳ unarchive');
      entry = await entry.unarchive();
    }

    if (entry.isPublished()) {
      console.log('    ↳ unpublish');
      entry = await entry.unpublish();
    }

    await entry.delete();

    console.log('    ✓ deleted');
    return true;
  } catch (error) {
    const message = getErrorMessage(error);

    console.error(`    ✗ ERROR: ${message}`);

    errors.push({
      type: 'Entry',
      id,
      message,
    });

    return false;
  }
}

async function deleteAsset(environment, id) {
  try {
    let asset = await environment.getAsset(id);

    console.log(`  Asset: ${id}`);

    if (asset.isArchived()) {
      console.log('    ↳ unarchive');
      asset = await asset.unarchive();
    }

    if (asset.isPublished()) {
      console.log('    ↳ unpublish');
      asset = await asset.unpublish();
    }

    await asset.delete();

    console.log('    ✓ deleted');
    return true;
  } catch (error) {
    const message = getErrorMessage(error);

    console.error(`    ✗ ERROR: ${message}`);

    errors.push({
      type: 'Asset',
      id,
      message,
    });

    return false;
  }
}

async function deleteContentType(environment, id) {
  try {
    let contentType = await environment.getContentType(id);

    console.log(`  Content Type: ${id}`);

    if (contentType.isPublished()) {
      console.log('    ↳ unpublish');
      contentType = await contentType.unpublish();
    }

    await contentType.delete();

    console.log('    ✓ deleted');
    return true;
  } catch (error) {
    const message = getErrorMessage(error);

    console.error(`    ✗ ERROR: ${message}`);

    errors.push({
      type: 'ContentType',
      id,
      message,
    });

    return false;
  }
}

async function main() {
  console.log('');
  console.log('==========================================');
  console.log(' CONTENTFUL ENVIRONMENT CLEANER');
  console.log('==========================================');
  console.log(`Space:       ${CONTENTFUL_SPACE_ID}`);
  console.log(`Environment: ${CONTENTFUL_ENVIRONMENT_ID}`);
  console.log(`Dry run:     ${isDryRun}`);
  console.log('==========================================');
  console.log('');

  // --------------------------------------------------------
  // 1. Validar que no estemos usando un alias
  // --------------------------------------------------------

  await validateEnvironmentIsNotAlias();

  const space = await legacyClient.getSpace(
    CONTENTFUL_SPACE_ID
  );

  const environment = await space.getEnvironment(
    CONTENTFUL_ENVIRONMENT_ID
  );

  console.log(
    `Environment encontrado: ${environment.name} (${environment.sys.id})`
  );

  console.log('');
  console.log('Analizando contenido...');
  console.log('');

  // --------------------------------------------------------
  // 2. Tomar snapshot de los IDs
  // --------------------------------------------------------

  const entryIds = await collectIds((query) =>
    environment.getEntries(query)
  );

  const assetIds = await collectIds((query) =>
    environment.getAssets(query)
  );

  const contentTypeIds = await collectIds((query) =>
    environment.getContentTypes(query)
  );

  console.log('Contenido encontrado:');
  console.log(`  Entries:       ${entryIds.length}`);
  console.log(`  Assets/Media:  ${assetIds.length}`);
  console.log(`  Content Types: ${contentTypeIds.length}`);

  console.log('');

  // --------------------------------------------------------
  // 3. DRY RUN
  // --------------------------------------------------------

  if (isDryRun) {
    console.log('==========================================');
    console.log(' DRY RUN');
    console.log('==========================================');
    console.log('');
    console.log('No se eliminó absolutamente nada.');
    console.log('');
    console.log('Si estos números son correctos, ejecuta con:');
    console.log('');
    console.log('DRY_RUN=false');
    console.log(
      `CONFIRM_ENVIRONMENT_ID=${CONTENTFUL_ENVIRONMENT_ID}`
    );
    console.log('');
    return;
  }

  // --------------------------------------------------------
  // 4. Confirmación adicional
  // --------------------------------------------------------

  if (
    CONFIRM_ENVIRONMENT_ID !==
    CONTENTFUL_ENVIRONMENT_ID
  ) {
    throw new Error(
      [
        'Confirmación incorrecta.',
        '',
        'Para ejecutar realmente el borrado debes establecer:',
        '',
        `CONFIRM_ENVIRONMENT_ID=${CONTENTFUL_ENVIRONMENT_ID}`,
      ].join('\n')
    );
  }

  console.log('⚠️ INICIANDO BORRADO REAL');
  console.log('');

  let deletedEntries = 0;
  let deletedAssets = 0;
  let deletedContentTypes = 0;

  // --------------------------------------------------------
  // 5. Entries
  // --------------------------------------------------------

  console.log('------------------------------------------');
  console.log('1/3 Eliminando Entries');
  console.log('------------------------------------------');

  for (const id of entryIds) {
    const deleted = await deleteEntry(environment, id);

    if (deleted) {
      deletedEntries++;
    }
  }

  console.log('');

  // --------------------------------------------------------
  // 6. Assets / Media
  // --------------------------------------------------------

  console.log('------------------------------------------');
  console.log('2/3 Eliminando Assets / Media');
  console.log('------------------------------------------');

  for (const id of assetIds) {
    const deleted = await deleteAsset(environment, id);

    if (deleted) {
      deletedAssets++;
    }
  }

  console.log('');

  // --------------------------------------------------------
  // 7. Content Types
  // --------------------------------------------------------

  console.log('------------------------------------------');
  console.log('3/3 Eliminando Content Types');
  console.log('------------------------------------------');

  for (const id of contentTypeIds) {
    const deleted = await deleteContentType(
      environment,
      id
    );

    if (deleted) {
      deletedContentTypes++;
    }
  }

  // --------------------------------------------------------
  // 8. Resultado
  // --------------------------------------------------------

  console.log('');
  console.log('==========================================');
  console.log(' RESULTADO');
  console.log('==========================================');

  console.log(
    `Entries eliminados:       ${deletedEntries}/${entryIds.length}`
  );

  console.log(
    `Assets eliminados:        ${deletedAssets}/${assetIds.length}`
  );

  console.log(
    `Content Types eliminados: ${deletedContentTypes}/${contentTypeIds.length}`
  );

  if (errors.length > 0) {
    console.log('');
    console.log(`⚠️ Hubo ${errors.length} errores:`);

    for (const error of errors) {
      console.log('');
      console.log(
        `[${error.type}] ${error.id}`
      );
      console.log(error.message);
    }

    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('✅ Environment limpiado correctamente.');
}

main().catch((error) => {
  console.error('');
  console.error('❌ El proceso falló:');
  console.error(getErrorMessage(error));

  process.exit(1);
});
