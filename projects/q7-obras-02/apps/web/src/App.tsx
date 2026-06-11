import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.js';
import { Shell } from './components/Shell.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { RecuperarPage } from './pages/RecuperarPage.js';
import { MisObrasPage } from './pages/MisObrasPage.js';
import { NuevaObraPage } from './pages/NuevaObraPage.js';
import { EquipoPage } from './pages/EquipoPage.js';
import { InvitacionPage } from './pages/InvitacionPage.js';
import { CajaPage } from './pages/CajaPage.js';
import { ComputoPage } from './pages/ComputoPage.js';
import { PresupuestosPage } from './pages/PresupuestosPage.js';
import { ComparadorPage } from './pages/ComparadorPage.js';
import { AdoptadoPage } from './pages/AdoptadoPage.js';
import { OrdenesCambioPage } from './pages/OrdenesCambioPage.js';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={user ? <Navigate to="/obras" /> : <LoginPage />} />
      <Route path="/registro" element={user ? <Navigate to="/obras" /> : <RegisterPage />} />
      <Route path="/recuperar" element={<RecuperarPage />} />
      <Route path="/invitacion/:token" element={<InvitacionPage />} />

      {/* Rutas protegidas */}
      <Route path="/*" element={user ? <Shell /> : <Navigate to="/login" />}>
        <Route path="obras" element={<MisObrasPage />} />
        <Route path="obras/nueva" element={<NuevaObraPage />} />
        <Route path="obras/:obraId/equipo" element={<EquipoPage />} />
        <Route path="obras/:obraId/caja" element={<CajaPage />} />
        <Route path="obras/:obraId/computo" element={<ComputoPage />} />
        <Route path="obras/:obraId/presupuestos" element={<PresupuestosPage />} />
        <Route path="obras/:obraId/presupuestos/comparar" element={<ComparadorPage />} />
        <Route path="obras/:obraId/presupuestos/adoptado" element={<AdoptadoPage />} />
        <Route path="obras/:obraId/cambios" element={<OrdenesCambioPage />} />
        <Route path="obras/:obraId/cambios/nueva" element={<OrdenesCambioPage />} />
        <Route path="obras/:obraId/cambios/:id" element={<OrdenesCambioPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={user ? '/obras' : '/login'} />} />
    </Routes>
  );
}
