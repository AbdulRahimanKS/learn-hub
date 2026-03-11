import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentWebinarRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/special-sessions', { replace: true });
  }, [navigate]);

  return null;
}
