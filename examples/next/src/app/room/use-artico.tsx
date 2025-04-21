import React from "react";

import type { SignalingState } from "@rtco/client";
import { Artico, SocketSignaling } from "@rtco/client";

export const useArtico = () => {
  const [state, setState] = React.useState<SignalingState>("disconnected");
  const [rtco, setRtco] = React.useState<Artico>();

  React.useEffect(() => {
    const artico = new Artico({
      debug: 4,
      signaling: new SocketSignaling({
        debug: 4,
        url:
          process.env.NODE_ENV === "development"
            ? "http://localhost:9000"
            : "https://0.artico.dev:443",
      }),
    });
    setRtco(artico);

    const handleOpen = () => {
      setState("ready");
    };

    const handleClose = () => {
      setState("disconnected");
    };

    const handleError = () => {
      setState("disconnected");
    };

    artico.on("open", handleOpen);
    artico.on("close", handleClose);
    artico.on("error", handleError);

    return () => {
      artico.off("open", handleOpen);
      artico.off("close", handleClose);
      artico.off("error", handleError);
      artico.close();
    };
  }, []);

  return { rtco, state };
};
