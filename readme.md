# Purposes
This application based on electron is intended to make easier the life with mp4 video files. the two basic functionnalities are to extract part of them based on chapters embedded and to generate subtitles.

# Caution
Due to agressive power management on the some computers such as on mac, or kali linux, the kernel suspends processes.

to prevent the kernel to suspend the program, the following sections describe procedures for the 3 main OS on the market.

**Mac OS**

run in a terminal
```bash
pmset noidle
```
or

```bash
caffeinate -i ...
```

**Linux**

for each linux distro the installer should be select: while for ubuntu apt is the default installer, on fedora and red hat it is yum.

```bash
sudo add-apt-repository ppa:caffeine-developers/ppa
sudo apt-get update
sudo apt-get install caffeine
```
