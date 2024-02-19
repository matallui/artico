import React from "react";
import { Artico, SignalingState } from "@rtco/client";

export const useArtico = () => {
  const [state, setState] = React.useState<SignalingState>("disconnected");
  const rtco = React.useMemo(() => {
    const artico = new Artico({ debug: 4 });

    artico.on("open", () => {
      setState("ready");
    });

    artico.on("close", () => {
      setState("disconnected");
    });

    artico.on("error", () => {
      setState("disconnected");
    });

    return artico;
  }, []);

  return { rtco, state };
};
