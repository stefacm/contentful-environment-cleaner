require('dotenv').config();

function getEnvironmentConfig(env = process.env) {
  const required = [
    'CONTENTFUL_MANAGEMENT_TOKEN',
    'CONTENTFUL_SPACE_ID',
    'CONTENTFUL_ENVIRONMENT_ID',
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Falta ${key}`);
    }
  }

  return {
    managementToken: env.CONTENTFUL_MANAGEMENT_TOKEN,
    spaceId: env.CONTENTFUL_SPACE_ID,
    environmentId: env.CONTENTFUL_ENVIRONMENT_ID,
    isDryRun: (env.DRY_RUN || 'false').toLowerCase() !== 'false',
    confirmationEnvironmentId: env.CONFIRM_ENVIRONMENT_ID,
  };
}

module.exports = { getEnvironmentConfig };
