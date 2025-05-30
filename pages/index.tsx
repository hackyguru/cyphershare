// pages/index.tsx (lean entry)
import MainLayout from "@/components/layout/MainLayout";
import { FileUpload } from "@/components/files/FileUpload";
import { FileList } from "@/components/files/FileList";
import WakuDebugConsole from "@/components/debug-consoles/WakuDebugConsole";
import CodexDebugConsole from "@/components/debug-consoles/CodexDebugConsole";
import TacoDebugConsole from "@/components/debug-consoles/TacoDebugConsole";
// Uncomment if want to add this component into the index page
// import NodeInfo from "@/components/codex/NodeInfo";
import Head from "next/head";

function Home() {
  return (
    <>
      <Head>
        <title>CypherShare</title>
      </Head>
      <MainLayout>
        <div className="container max-w-5xl py-8 mx-auto">
          <div className="space-y-4 mb-6">
            {/* <NodeInfo /> */}
          </div>
          <FileUpload />
          <div className="mt-6">
            <FileList />
          </div>
          <WakuDebugConsole />
          <CodexDebugConsole />
          <TacoDebugConsole />
        </div>
      </MainLayout>
    </>
  );
}

export default Home;
