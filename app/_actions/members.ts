"use server";

export async function blockMember(
  _userApiId: string,
  _reason: string,
): Promise<void> {
  throw new Error("blockMember not implemented yet");
}

export async function updateMember(
  _userApiId: string,
  _patch: Record<string, unknown>,
): Promise<void> {
  throw new Error("updateMember not implemented yet");
}
