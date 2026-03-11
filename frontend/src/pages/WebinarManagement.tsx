import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function WebinarManagementRedirect() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  
  useEffect(() => {
    if (batchId) {
      navigate(`/special-sessions?batchId=${batchId}`, { replace: true });
    } else {
      navigate('/special-sessions', { replace: true });
    }
  }, [navigate, batchId]);

  return null;
}
