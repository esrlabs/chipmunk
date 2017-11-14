#base/archlinux
FROM base/archlinux
# Dockerfile author / maintainer
MAINTAINER Dmitry Astafyev <dmitry.astafyev@esrlabs.com>

#update system
RUN pacman --needed --noprogressbar --noconfirm -Suy; exit 0
#add yaourt
RUN printf "\n" >> /etc/pacman.conf
RUN printf "[archlinuxfr]\n" >> /etc/pacman.conf
RUN printf "SigLevel = Never\n" >> /etc/pacman.conf
RUN printf "Server = http://repo.archlinux.fr/\$arch\n" >> /etc/pacman.conf
RUN cat /etc/pacman.conf
#update system
RUN pacman --needed --noprogressbar --noconfirm -Suy; exit 0
#update system
RUN pacman --needed --noprogressbar --noconfirm -Sy base-devel wget yajl yaourt zsync; exit 0
#install npm, node and git
RUN pacman --needed --noprogressbar --noconfirm -Sy nodejs npm git nano; exit 0
#downgrade version of NPM... Yeah, don't ask...
RUN npm install -g npm@4.6.1
#add user
#RUN useradd -m -G wheel -s /bin/bash developer
#change user
RUN useradd -m developer
# set the user's password to blank
RUN echo "developer:" | chpasswd -e
# give the aur user passwordless sudo powers
RUN echo "developer      ALL = NOPASSWD: ALL" >> /etc/sudoers
#add libicns
RUN su developer -c "yaourt --noconfirm -Sy libicns"
#install gulp globally
RUN npm install github:gulpjs/gulp#4.0 --global
#install gnome
RUN pacman --needed --noprogressbar --noconfirm -Sy gnome; exit 0

WORKDIR /application
ADD . /docker

ENTRYPOINT sed -i 's/\r$//' /docker/install.sh && sh /docker/install.sh && sh /docker/gulp.sh && /bin/bash