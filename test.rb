require 'pty'

system('stty raw; stty -echo')
at_exit { system('stty sane') }

CMD = "/home/plonk/g/mogeRPG/mogerpg.exe"
#CMD = "bash"
reader, writer, pid = PTY.spawn("stty rows 24; stty columns 80; " + CMD)

loop do
  rs, _, _ = IO.select([reader, STDIN])
  rs.each do |r|
    if r == STDIN
      begin
        writer.write(STDIN.read_nonblock(4096))
      rescue Errno::EIO
      end
    elsif r == reader
      begin
        STDOUT.write(reader.read_nonblock(4096))
      rescue Errno::EIO
        exit
      end
    end
  end
end
