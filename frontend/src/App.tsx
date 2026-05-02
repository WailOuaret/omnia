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

/** Legacy share link `?paper=1` must land on the standalone COVID paper figure, not dashboard chrome. */
function DemoWorkbenchEntry() {
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
      <Route path="/" element={<DemoWorkbenchEntry />} />
      <Route path="/demo" element={<DemoWorkbenchEntry />} />
      <Route
        path="/paper-demo"
        element={
          <Suspense fallback={<RouteFallback />}>
            <PaperDemoPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
