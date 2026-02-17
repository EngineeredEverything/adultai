import { IPinfo, IPinfoWrapper, LruCache, Options } from "node-ipinfo";
declare global {
  var ipinfoWrapper: IPinfoWrapper | undefined;
}
export const ipinfoWrapper = globalThis.ipinfoWrapper || new IPinfoWrapper(
  process.env.IP_ACCESS_TOKEN || "",
  new LruCache({
    max: 5000,
    ttl: 24 * 1000 * 60 * 60,
  })
);

export const getLocationByIp = async (ip: string) => {
  const ipinfo = await ipinfoWrapper
    .lookupIp(ip)
    .catch(() => ({
      ip: "localhost",
      city: "localhost",
      country: "localhost",
    }));

  if (!ipinfo?.ip) ipinfo.ip = "localhost";
  if (!ipinfo?.city) ipinfo.city = "localhost";
  if (!ipinfo?.country) ipinfo.country = "localhost";
  return ipinfo;
};
