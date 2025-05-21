#!/bin/bash
set -e # This is critical! It will make the script exit immediately if any command fails.

echo "--- Starting ec2-tool.sh script ---"

# ... rest of your script ...

echo "--- Updating apt package lists (first pass) ---"
apt update -y
apt install openjdk-17-jre -y
apt install curl -y
apt install python3 -y

echo "--- Setting up Jenkins repository ---"
wget -O /usr/share/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" https://pkg.jenkins.io/debian binary/ | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
apt update -y
apt install jenkins -y

echo "--- Installing PostgreSQL ---"
apt install postgresql postgresql-contrib -y

echo "--- Installing Docker ---"
apt install docker.io -y
systemctl enable docker
systemctl start docker # It's good practice to start Docker before adding user to group
sudo usermod -aG docker jenkins # Note: The 'jenkins' user might not be fully available to Docker until next login, but group modification happens.

echo "--- Installing AWS CLI v2 ---"
apt install unzip -y # Ensure unzip is present
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install # This assumes you are in /tmp when this runs, adjust path if needed

echo "--- Installing kubectl ---"
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl.sha256"
echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check # This command will fail if checksum doesn't match
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

echo "--- Installing eksctl ---"
ARCH=amd64
PLATFORM=$(uname -s)_$ARCH
curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$PLATFORM.tar.gz"
curl -sL "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_checksums.txt" | grep $PLATFORM | sha256sum --check
tar -xzf eksctl_$PLATFORM.tar.gz -C /tmp && rm eksctl_$PLATFORM.tar.gz
sudo mv /tmp/eksctl /usr/local/bin

echo "--- Installing Helm ---"
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

echo "--- Installing Node.js 16.x ---"
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - && sudo apt-get install -y nodejs

echo "--- Final apt update ---"
apt update -y

echo "--- ec2-tool.sh script finished successfully ---"