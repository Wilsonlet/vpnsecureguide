{pkgs}: {
  deps = [
    pkgs.socat
    pkgs.proxychains-ng
    pkgs.iptables
    pkgs.curl
    pkgs.postgresql
  ];
}
