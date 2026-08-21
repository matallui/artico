# Artico

Artico connects peers directly through calls and multi-peer rooms coordinated by signaling.

## Language

**Peer**:
An Artico participant identified through signaling and capable of forming direct connections with other participants.

**Call**:
A direct session between two peers.

**Room**:
A mesh-like session in which a peer maintains at most one Room Call to each remote peer.

**Room Call**:
The Call owned by a Room for one remote peer, from signaling discovery until removal from the Room roster.

**Room roster**:
The remote peers for which a Room owns Room Calls, including Calls that are not yet connected.
_Avoid_: Connected peers, Room membership
