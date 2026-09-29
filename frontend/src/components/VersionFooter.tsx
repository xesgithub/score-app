import { useEffect, useState } from 'react';
import { adminApi } from '../api';

// แสดงเลขเวอร์ชันแอปที่มุมล่างขวา (ดึงจาก backend /api/version)
export default function VersionFooter() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    adminApi
      .getVersion()
      .then((r) => setVersion(r.version))
      .catch(() => setVersion(''));
  }, []);

  if (!version) return null;
  return (
    <div className="fixed bottom-2 right-3 text-xs text-gray-400 select-none pointer-events-none">
      score-app v{version}
    </div>
  );
}
