import dynamic from "next/dynamic";

const UploadScreen = dynamic(
  () => import("@/components/UploadScreen").then((m) => m.UploadScreen),
  { ssr: false }
);

export default function Home() {
  return <UploadScreen />;
}
