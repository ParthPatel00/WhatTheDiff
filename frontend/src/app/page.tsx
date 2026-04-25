import dynamic from "next/dynamic";

const UploadScreen = dynamic(
  () => import("@/components/shell/UploadScreen").then((m) => m.UploadScreen),
  { ssr: false, loading: () => <div style={{ background: "#1a1a1a", height: "100vh" }} /> }
);

export default function Home() {
  return <UploadScreen />;
}
