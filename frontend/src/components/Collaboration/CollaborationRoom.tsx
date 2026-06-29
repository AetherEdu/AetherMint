export function CollaborationRoom({ roomId, ...props }: { roomId: string; [key: string]: any }) {
  return <div data-room-id={roomId} {...props}>Collaboration Room: {roomId}</div>;
}

export default CollaborationRoom;
