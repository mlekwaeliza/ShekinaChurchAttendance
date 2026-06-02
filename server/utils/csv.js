function escapeCsvValue(val) {
  const str = val == null ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function toCsvRow(values) {
  return values.map(escapeCsvValue).join(',');
}

module.exports = { escapeCsvValue, toCsvRow };
