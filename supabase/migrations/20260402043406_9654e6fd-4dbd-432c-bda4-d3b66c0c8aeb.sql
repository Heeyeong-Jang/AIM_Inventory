
CREATE POLICY "Allow anon read on skus" ON skus FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on inventory" ON inventory FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on inbound_orders" ON inbound_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on outbound_logs" ON outbound_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on inbound_orders" ON inbound_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert on outbound_logs" ON outbound_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert on skus" ON skus FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert on inventory" ON inventory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on inventory" ON inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
