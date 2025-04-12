{pkgs}: {
  deps = [
    pkgs.proxychains
    pkgs.tor
    pkgs.nftables
    pkgs.shadowsocks-libev
    pkgs.openvpn
    pkgs.wireguard-tools
    pkgs.socat
    pkgs.proxychains-ng
    pkgs.iptables
    pkgs.curl
    pkgs.postgresql
  ];
}
