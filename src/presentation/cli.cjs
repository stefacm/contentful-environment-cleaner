const { getEnvironmentConfig } = require('../config/environment.cjs');
const { cleanEnvironment, getErrorMessage } = require('../application/use-cases/clean-environment.cjs');
const { createContentfulGateway } = require('../infrastructure/contentful/contentful-gateway.cjs');

async function run() {
  const config = getEnvironmentConfig();
  const gateway = createContentfulGateway(config);

  console.log('');
  console.log('==========================================');
  console.log(' CONTENTFUL ENVIRONMENT CLEANER');
  console.log('==========================================');
  console.log(`Space:       ${config.spaceId}`);
  console.log(`Environment: ${config.environmentId}`);
  console.log(`Dry run:     ${config.isDryRun}`);
  console.log('==========================================');
  console.log('');

  const result = await cleanEnvironment({ gateway, config });

  if (!result.dryRun) {
    console.log('');
    console.log('Environment limpiado correctamente.');
  }
}

run().catch((error) => {
  console.error('');
  console.error('El proceso falló:');
  console.error(getErrorMessage(error));

  if (error.details) {
    for (const detail of error.details) {
      console.error(`[${detail.type}] ${detail.id}`);
      console.error(detail.message);
    }
  }

  process.exitCode = 1;
});
