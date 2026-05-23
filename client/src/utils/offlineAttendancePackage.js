export const OFFLINE_PACKAGE_SCHEMA = 'church-attendance-offline-package/v1';

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function simpleHash(input) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

export function createOfflineAttendancePackage({
  date,
  serviceId,
  serviceTypes = [],
  sectionInfo,
  members = [],
  attendance = {}
}) {
  const service = serviceTypes.find((item) => item.id === serviceId);
  const leaderId = sectionInfo?.leader_id || members[0]?.leader_id;
  const sectionId = sectionInfo?.section_id || members[0]?.section_id;

  const rows = members
    .map((member) => ({
      member_id: member.id,
      membership_id: member.membership_id,
      full_name: member.full_name,
      status: attendance[member.id]
    }))
    .filter((row) => row.status)
    .sort((left, right) => left.member_id - right.member_id);

  const fingerprint = stableStringify({
    date,
    service_id: serviceId,
    leader_id: leaderId,
    section_id: sectionId,
    attendance: rows.map((row) => [row.member_id, row.status])
  });

  return {
    schema: OFFLINE_PACKAGE_SCHEMA,
    package_id: `offline-${date}-${serviceId}-${leaderId || 'leader'}-${simpleHash(fingerprint)}`,
    generated_at: new Date().toISOString(),
    date,
    service_id: serviceId,
    service_name: service?.name || 'Selected service',
    section: {
      id: sectionId,
      name: sectionInfo?.name || members[0]?.section_name || ''
    },
    leader: {
      id: leaderId,
      name: sectionInfo?.leader || members[0]?.leader_name || ''
    },
    attendance: rows
  };
}

export function downloadOfflineAttendancePackage(offlinePackage) {
  const blob = new Blob([JSON.stringify(offlinePackage, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const service = String(offlinePackage.service_name || 'service').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  link.href = url;
  link.download = `offline-attendance-${offlinePackage.date}-${service}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
