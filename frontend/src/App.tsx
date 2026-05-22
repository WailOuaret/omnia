import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { PageSkeleton } from "./components/common/PageSkeleton";

const DemoWorkbenchPage = lazy(() =>
  import("./pages/DemoWorkbenchPage").then((m) => ({ default: m.DemoWorkbenchPage })),
);

const PaperDemoPage = lazy(() => import("./pages/PaperDemoPage").then((m) => ({ default: m.PaperDemoPage })));

function RouteFallback() {
  return <PageSkeleton rows={3} />;
}

/**
 * Legacy share link `?paper=1` must keep landing on the static paper-demo page.
 * Otherwise `/demo` serves the backend-connected workbench pipeline.
 */
function DemoEntry() {
  const [searchParams] = useSearchParams();
  if (searchParams.get("paper") === "1") {
    return <Navigate to="/paper-demo" replace />;
  }
  return (
    <Suspense fallback={<RouteFallback />}>
      <DemoWorkbenchPage />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/paper-demo" replace />} />
      <Route
        path="/paper-demo"
        element={
          <Suspense fallback={<RouteFallback />}>
            <PaperDemoPage />
          </Suspense>
        }
      />
      <Route path="/demo" element={<DemoEntry />} />
      <Route
        path="/workbench"
        element={
          <Suspense fallback={<RouteFallback />}>
            <DemoWorkbenchPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
