const { queries } = require('./database');
(async () => {
  try {
    const types = await queries.getContributionTypes();
    console.log('TYPES OK, count =', types.length, '|', JSON.stringify(types).slice(0, 200));
  } catch (e) { console.log('TYPES ERR:', e.message); }
  try {
    const contribs = await queries.getContributions({});
    console.log('CONTRIBS OK, count =', contribs.length);
  } catch (e) { console.log('CONTRIBS ERR:', e.message); }
  process.exit(0);
})();
