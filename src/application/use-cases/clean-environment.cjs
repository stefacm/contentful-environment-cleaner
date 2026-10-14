function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || JSON.stringify(error);
}

async function cleanEnvironment({ gateway, config, logger = console }) {
  const {
    spaceId,
    environmentId,
    isDryRun,
    confirmationEnvironmentId,
  } = config;

  const alias = await gateway.isEnvironmentAlias(spaceId, environmentId);

  if (alias) {
    const target = alias.environment?.sys?.id || alias.sys?.environment?.sys?.id || 'desconocido';
    throw new Error([
      `El ID "${environmentId}" corresponde a un ENVIRONMENT ALIAS.`,
      `Actualmente apunta a: "${target}".`,
      '',
      'Por seguridad el script no permite limpiar usando un alias.',
      'Usa directamente el ID real del environment.',
    ].join('\n'));
  }

  const environment = await gateway.getEnvironment(spaceId, environmentId);
  const types = ['Entry', 'Asset', 'ContentType'];
  const idsByType = {};

  for (const type of types) {
    idsByType[type] = await gateway.listIds(environment, type);
  }

  logger.log('Contenido encontrado:');
  logger.log(`  Entries:       ${idsByType.Entry.length}`);
  logger.log(`  Assets/Media:  ${idsByType.Asset.length}`);
  logger.log(`  Content Types: ${idsByType.ContentType.length}`);

  if (isDryRun) {
    logger.log('');
    logger.log('==========================================');
    logger.log(' DRY RUN');
    logger.log('==========================================');
    logger.log('');
    logger.log('No se eliminó absolutamente nada.');
    logger.log('');
    logger.log('Si estos números son correctos, ejecuta con:');
    logger.log('');
    logger.log('DRY_RUN=false');
    logger.log(`CONFIRM_ENVIRONMENT_ID=${environmentId}`);
    return { dryRun: true, deleted: {} };
  }

  if (confirmationEnvironmentId !== environmentId) {
    throw new Error([
      'Confirmación incorrecta.',
      '',
      'Para ejecutar realmente el borrado debes establecer:',
      '',
      `CONFIRM_ENVIRONMENT_ID=${environmentId}`,
    ].join('\n'));
  }

  const errors = [];
  const deleted = {};

  for (const type of types) {
    deleted[type] = 0;
    logger.log(`Eliminando ${type}...`);

    for (const id of idsByType[type]) {
      try {
        logger.log(`  ${type}: ${id}`);
        await gateway.delete(environment, type, id);
        deleted[type]++;
      } catch (error) {
        const message = getErrorMessage(error);
        logger.error(`    ✗ ERROR: ${message}`);
        errors.push({ type, id, message });
      }
    }
  }

  if (errors.length > 0) {
    const error = new Error(`Hubo ${errors.length} errores durante la limpieza.`);
    error.details = errors;
    throw error;
  }

  return { dryRun: false, deleted };
}

module.exports = { cleanEnvironment, getErrorMessage };
